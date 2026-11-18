"""
Swadeshi Khata - Authentication & User Security Test Suite
==========================================================
Tests the additive authentication endpoints:
1. User registration: POST /auth/signup
2. Duplicate email prevention
3. Password verification: POST /auth/login
4. Mobile OTP request & verification: POST /auth/otp/request & /auth/otp/verify
5. User profile retrieval: GET /auth/me
6. Logout session invalidation: POST /auth/logout
"""

import uuid
import pytest
from src.api.database import SessionLocal, UserModel, OtpRequestModel
from src.api.main import (
    signup,
    login,
    request_otp,
    verify_otp,
    logout,
    get_user_profile,
    SignupRequest,
    LoginRequest,
    OtpRequest,
    OtpVerifyRequest,
)
from fastapi import HTTPException


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_auth_signup_and_duplicate_prevention(db_session):
    unique_suffix = str(uuid.uuid4())[:8]
    email = f"sharma_{unique_suffix}@swadeshikhata.in"
    mobile = f"98{str(uuid.uuid4().int)[:8]}"

    req = SignupRequest(
        name="Ramesh Sharma",
        business_name="Sharma General Store",
        business_type="kirana",
        state="Delhi",
        mobile=mobile,
        email=email,
        password="SecurePassword@2026",
        gstin="07AAAAA0000A1Z5",
    )

    resp = signup(req, db=db_session)
    assert "access_token" in resp
    assert resp["user"]["email"] == email
    assert resp["user"]["business_name"] == "Sharma General Store"

    # Duplicate email must raise HTTP 400
    with pytest.raises(HTTPException) as exc_info:
        signup(req, db=db_session)
    assert exc_info.value.status_code == 400


def test_auth_login_success_and_failure(db_session):
    unique_suffix = str(uuid.uuid4())[:8]
    email = f"patel_{unique_suffix}@swadeshikhata.in"
    mobile = f"99{str(uuid.uuid4().int)[:8]}"

    signup_req = SignupRequest(
        name="Jignesh Patel",
        business_name="Patel Traders",
        business_type="wholesale",
        state="Gujarat",
        mobile=mobile,
        email=email,
        password="TradersPassword@123",
    )
    signup(signup_req, db=db_session)

    # Login with valid email
    login_resp = login(LoginRequest(login=email, password="TradersPassword@123"), db=db_session)
    assert "access_token" in login_resp
    assert login_resp["user"]["name"] == "Jignesh Patel"

    # Login with valid mobile
    login_mobile = login(LoginRequest(login=mobile, password="TradersPassword@123"), db=db_session)
    assert "access_token" in login_mobile

    # Login with invalid password
    with pytest.raises(HTTPException) as exc_info:
        login(LoginRequest(login=email, password="WrongPassword"), db=db_session)
    assert exc_info.value.status_code == 401


def test_auth_otp_flow(db_session):
    mobile = "9811223344"

    # Request OTP
    otp_resp = request_otp(OtpRequest(mobile=mobile), db=db_session)
    assert otp_resp["status"] == "success"
    otp_code = otp_resp["dev_otp"]
    assert len(otp_code) == 6

    # Verify OTP
    verify_resp = verify_otp(OtpVerifyRequest(mobile=mobile, otp_code=otp_code), db=db_session)
    assert "access_token" in verify_resp
    assert verify_resp["user"]["mobile"] == mobile


def test_auth_logout_and_profile():
    logout_resp = logout()
    assert logout_resp["status"] == "success"

    # Profile without token returns default guest profile
    profile = get_user_profile(current_user=None, db=None)
    assert profile["name"] == "Ramesh Sharma"
    assert profile["business_name"] == "Sharma General Store"
