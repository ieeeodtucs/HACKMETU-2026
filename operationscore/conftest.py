"""
Root-level conftest.py.

Ensures the repository root (/home/umut/hackmetu/operationscore) is on
sys.path so that 'server.*' imports resolve correctly when pytest is
invoked from any directory.
"""
import sys
import os

# Insert repo root at the front of sys.path
sys.path.insert(0, os.path.dirname(__file__))
