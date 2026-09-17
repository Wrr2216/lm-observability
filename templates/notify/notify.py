#!/usr/bin/env python3
"""Send operational alerts independently to Pushover and Wazuh (stdlib only)."""
import argparse
import concurrent.futures
import datetime
import json
import os
import socket
import sys
import urllib.request


def send_pushover(event):
    token, user = os.getenv('PUSHOVER_TOKEN', ''), os.getenv('PUSHOVER_USER', '')
    if not token or not user or os.getenv('PUSHOVER_ENABLED') == 'false':
        return False
    body = dict(token=token, user=user, title=event['title'][:250],
                message=event['message'][:1024], priority=event['priority'])
    if os.getenv('PUSHOVER_DEVICE'):
        body['device'] = os.environ['PUSHOVER_DEVICE']
    if body['priority'] == 2:
        body.update(retry=60, expire=3600)
    request = urllib.request.Request('https://api.pushover.net/1/messages.json',
        data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            if json.load(response).get('status') != 1:
                raise ValueError('API rejected message')
        return True
    except Exception:
        # Never print a request object or response body containing credentials.
        print('Pushover delivery failed', file=sys.stderr)
        return False


def send_wazuh(event):
    host = os.getenv('WAZUH_HOST', '').strip()
    if not host or os.getenv('WAZUH_ENABLED') == 'false':
        return False
    try:
        port = int(os.getenv('WAZUH_PORT', '514'))
        protocol = os.getenv('WAZUH_PROTOCOL', 'tcp')
        if not 1 <= port <= 65535 or protocol not in ('tcp', 'udp', 'tcp4', 'udp4'):
            raise ValueError('Invalid receiver configuration')
        now = datetime.datetime.now(datetime.timezone.utc)
        payload = dict(event, app=event['app'][:128], title=event['title'][:250], message=event['message'][:1024],
                       event='notification', ts=now.isoformat())
        severity = 3 if event['priority'] >= 1 else 6 if event['priority'] < 0 else 5
        stamp = now.strftime('%b ') + str(now.day).rjust(2) + now.strftime(' %H:%M:%S')
        hostname = ''.join(c if c.isalnum() or c in '_.-' else '_' for c in socket.gethostname())
        line = f'<{128 + severity}>{stamp} {hostname} mct-alert: {json.dumps(payload, ensure_ascii=False)}'
        if protocol.startswith('udp'):
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
                sock.settimeout(3)
                sock.sendto(line.encode(), (host, port))
        else:
            with socket.create_connection((host, port), timeout=3) as sock:
                sock.sendall((line + '\n').encode())
        return True
    except Exception:
        print('Wazuh delivery failed', file=sys.stderr)
        return False


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--app', default=os.getenv('ALERT_APP', os.getenv('GITHUB_REPOSITORY', 'operations')))
    parser.add_argument('--title', default=os.getenv('ALERT_TITLE', 'Operations alert'))
    parser.add_argument('--message', default=os.getenv('ALERT_MESSAGE', ''))
    parser.add_argument('--priority', type=int, choices=range(-2, 3), default=int(os.getenv('ALERT_PRIORITY', '0')))
    args = parser.parse_args()
    event = vars(args)
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        push, wazuh = [result.result() for result in [pool.submit(send_pushover, event), pool.submit(send_wazuh, event)]]
    print(json.dumps({'pushover_sent': push, 'wazuh_sent': wazuh}))
    # A notification outage must never turn a successful build/backup into a failure.


if __name__ == '__main__':
    main()
