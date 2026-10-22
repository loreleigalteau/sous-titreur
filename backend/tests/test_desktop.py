import pytest

from app.desktop import filename_from_disposition
from app.server import download_headers


@pytest.mark.parametrize("name", ["video.srt", "Clip été.mp4", "ma vidéo tiktok-subtitled.mp4"])
def test_the_save_dialog_proposes_the_server_file_name(name):
    header = download_headers(name)["Content-Disposition"]
    assert filename_from_disposition(header) == name


def test_plain_file_name():
    assert filename_from_disposition('attachment; filename="a.vtt"') == "a.vtt"


def test_no_file_name():
    assert filename_from_disposition("") is None
