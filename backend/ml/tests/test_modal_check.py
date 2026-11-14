"""Privacy/import boundaries only. These tests do not perform cloud inference."""
import json
import subprocess
import sys

import pytest

pytest.importorskip('modal')

from backend.ml.modal_check import public_result


def test_public_report_excludes_scores_without_destroying_private_report():
    result = {'status': 'completed', 'raw_scores': {'depression': -2.5, 'anxiety': 4.2},
              'inference_sec': [1.2, 1.1], 'preparation': {'status': 'prepared_not_inferred'}}
    public = public_result(result)
    assert 'raw_scores' not in json.dumps(public)
    assert public['inference_sec'] == [1.2, 1.1]
    assert result['raw_scores'] == {'depression': -2.5, 'anxiety': 4.2}


def test_modal_definition_import_does_not_load_api_or_model():
    code = ('import sys; import backend.ml.modal_check; '
            'assert not {"torch", "fastapi", "sqlalchemy", "backend.app", '
            '"backend.repository", "backend.analysis"}.intersection(sys.modules)')
    subprocess.run([sys.executable, '-c', code], check=True, capture_output=True)
