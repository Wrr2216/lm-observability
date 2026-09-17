import importlib.util
import json
import os
import socket
import threading
import unittest
import sys
from pathlib import Path
from unittest.mock import patch

sys.dont_write_bytecode = True

spec=importlib.util.spec_from_file_location('notify',Path(__file__).resolve().parents[1] / 'templates/notify/notify.py')
notify=importlib.util.module_from_spec(spec);spec.loader.exec_module(notify)
EVENT=dict(app='test-app',title='Test',message='hello\nworld',priority=1)

class NotifyTests(unittest.TestCase):
    def test_unconfigured_makes_no_network_calls(self):
        with patch.dict(os.environ,{},clear=True),patch('urllib.request.urlopen') as fetch:
            self.assertFalse(notify.send_pushover(EVENT));self.assertFalse(notify.send_wazuh(EVENT));fetch.assert_not_called()
    def test_push_payload(self):
        with patch.dict(os.environ,dict(PUSHOVER_TOKEN='test',PUSHOVER_USER='test'),clear=True),patch('urllib.request.urlopen') as fetch:
            fetch.return_value.__enter__.return_value.read.return_value=b'{"status":1}'
            self.assertTrue(notify.send_pushover(dict(EVENT,priority=2,message='x'*2000)))
            body=json.loads(fetch.call_args.args[0].data)
            self.assertEqual(body['priority'],2);self.assertEqual(body['retry'],60);self.assertEqual(body['expire'],3600)
            self.assertEqual(len(body['message']),1024)
    def test_api_rejection_and_network_error(self):
        with patch.dict(os.environ,dict(PUSHOVER_TOKEN='test',PUSHOVER_USER='test'),clear=True),patch('urllib.request.urlopen') as fetch:
            fetch.return_value.__enter__.return_value.read.return_value=b'{"status":0}'
            self.assertFalse(notify.send_pushover(EVENT))
            fetch.side_effect=OSError('offline');self.assertFalse(notify.send_pushover(EVENT))
    def test_tcp_json_and_framing(self):
        with socket.socket() as server:
            server.bind(('127.0.0.1',0));server.listen(1);server.settimeout(3)
            results=[]
            def receive():
                with server.accept()[0] as connection:
                    results.append(connection.recv(20000).decode())
            thread=threading.Thread(target=receive);thread.start()
            with patch.dict(os.environ,dict(WAZUH_HOST='127.0.0.1',WAZUH_PORT=str(server.getsockname()[1]),WAZUH_PROTOCOL='tcp'),clear=True):
                self.assertTrue(notify.send_wazuh(EVENT))
            thread.join(3);frame=results[0]
            self.assertEqual(frame.count('\n'),1)
            self.assertEqual(json.loads(frame[frame.index('{'):])['message'],EVENT['message'])
    def test_invalid_config_does_not_throw(self):
        with patch.dict(os.environ,dict(WAZUH_HOST='127.0.0.1',WAZUH_PORT='bad'),clear=True):
            self.assertFalse(notify.send_wazuh(EVENT))

if __name__=='__main__':unittest.main()
