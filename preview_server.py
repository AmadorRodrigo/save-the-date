"""Local-only static preview server with byte-range support for MP4 playback."""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
import re


class LimitedReader:
    def __init__(self, file_obj, length):
        self.file_obj = file_obj
        self.remaining = length

    def read(self, size=-1):
        if self.remaining <= 0:
            return b""
        if size < 0 or size > self.remaining:
            size = self.remaining
        data = self.file_obj.read(size)
        self.remaining -= len(data)
        return data

    def close(self):
        self.file_obj.close()


class RangeRequestHandler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def send_head(self):
        path = self.translate_path(self.path)
        if not os.path.isfile(path):
            return super().send_head()

        size = os.path.getsize(path)
        range_header = self.headers.get("Range")
        if not range_header:
            file_obj = open(path, "rb")
            self.send_response(200)
            self.send_header("Content-type", self.guess_type(path))
            self.send_header("Content-Length", str(size))
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Last-Modified", self.date_time_string(os.path.getmtime(path)))
            self.end_headers()
            return file_obj

        match = re.fullmatch(r"bytes=(\d*)-(\d*)", range_header.strip())
        if not match or size == 0:
            return self._range_not_satisfiable(size)

        first, last = match.groups()
        if first:
            start = int(first)
            end = min(int(last), size - 1) if last else size - 1
        else:
            suffix_length = int(last or 0)
            if suffix_length == 0:
                return self._range_not_satisfiable(size)
            start = max(0, size - suffix_length)
            end = size - 1

        if start >= size or end < start:
            return self._range_not_satisfiable(size)

        length = end - start + 1
        file_obj = open(path, "rb")
        file_obj.seek(start)
        self.send_response(206)
        self.send_header("Content-type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(length))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Last-Modified", self.date_time_string(os.path.getmtime(path)))
        self.end_headers()
        return LimitedReader(file_obj, length)

    def _range_not_satisfiable(self, size):
        self.send_response(416)
        self.send_header("Content-Range", f"bytes */{size}")
        self.send_header("Content-Length", "0")
        self.end_headers()
        return None


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 8000), RangeRequestHandler)
    print("Prévia local em http://127.0.0.1:8000 (Ctrl+C para encerrar)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
