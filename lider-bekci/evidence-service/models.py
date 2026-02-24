"""
Compliance Evidence Service — SQLAlchemy Models
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    hostname = Column(String(255), unique=True, nullable=False)
    ip = Column(String(45), nullable=False)
    os = Column(String(100), default="Pardus 23")
    plugin_status = Column(String(50), default="not_installed")  # installed, not_installed
    last_check = Column(DateTime, nullable=True)
    compliance_status = Column(String(50), default="pending")  # compliant, non_compliant, pending
    compliance_score = Column(Integer, default=0)
    online = Column(Boolean, default=False)
    violations = Column(Text, nullable=True)  # JSON string of violations list


class PolicyDefinition(Base):
    __tablename__ = "policy_definitions"

    id = Column(Integer, primary_key=True, index=True)
    policy_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    total_checked = Column(Integer, default=0)
    compliant = Column(Integer, default=0)
    non_compliant = Column(Integer, default=0)
    compliance_rate = Column(Float, default=0.0)
    severity = Column(String(50), default="medium")  # critical, high, medium, low
    category = Column(String(100), default="security")
    active = Column(Boolean, default=False)


class EvidenceLog(Base):
    __tablename__ = "evidence_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    client = Column(String(255), nullable=False)
    policy = Column(String(255), nullable=False)
    result = Column(String(50), nullable=False)  # compliant, non_compliant
    detail = Column(Text, nullable=True)
