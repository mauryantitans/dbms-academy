"""Checks on the real course content that the parser cannot express.

YAML turns some bare words into non-strings (null -> None, yes/no/on/off -> bool, 1e3 -> float). A concept named
`null` written unquoted therefore became None and crashed search and the grading endpoints, which join concept
lists into strings. Quote such words in content: concepts: ["null", three-valued-logic].
"""
from pathlib import Path

import pytest

from app.content.repository import Repository

CONTENT = Path(__file__).resolve().parents[2] / "content"


@pytest.fixture(scope="module")
def repo() -> Repository:
    return Repository.load(CONTENT)


def test_concepts_and_topics_are_strings(repo):
    lists = []
    for rec in repo.lessons.values():
        lists.append((f"lesson {rec.id} topics", rec.topics))
        if rec.doc:
            lists.append((f"lesson {rec.id} concepts", rec.doc.meta.get("concepts")))
    for pid, p in repo.projects.items():
        if p["doc"]:
            lists.append((f"project {pid} concepts", p["doc"].meta.get("concepts")))
    lists += [(f"exercise {eid}", ex.get("concepts")) for eid, ex in repo.exercises.items()]
    lists += [(f"question {qid}", q.get("concepts")) for qid, q in repo.questions.items()]
    for a in repo.assessments.values():
        lists += [(f"interview {i['id']}", i.get("concepts")) for i in a.get("interview", [])]
    bad = [f"{where}: {v!r}" for where, vals in lists for v in (vals or []) if not isinstance(v, str)]
    assert not bad, "non-string concepts/topics (quote YAML keywords such as null):\n" + "\n".join(bad)
