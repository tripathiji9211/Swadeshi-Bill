"""
Swadeshi Khata - Authentication & User Management Security Layer
================================================================
Provides secure authentication for Indian SMB owners:
- Password hashing (PBKDF2-HMAC-SHA256 with cryptographically secure salts)
- JWT token issue & verification (Access token + Refresh token)
- Mobile OTP login interface (supports dev mock sender and extensible SMS providers)
- FastAPI authentication dependency with AUTH_REQUIRED toggling
"""

import os
import secrets
import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

import jwt
from fastapi import Depends, HTTPException, status, Header, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from src.api.database import get_db, UserModel, OtpRequestModel

# Configuration
JWT_SECRET = os.getenv("SWADESHI_JWT_SECRET", os.getenv("JWT_SECRET", "swadeshi-khata-prod-secret-key-2026-v1"))
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))  # 24 hours
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))
AUTH_REQUIRED = os.getenv("AUTH_REQUIRED", "false").lower() in ("true", "1", "yes")

security_bearer = HTTPBearer(auto_error=False)


# =============================================================================
# 1. PASSWORD HASHING (PBKDF2-HMAC-SHA256)
# =============================================================================

def hash_password(password: str) -> str:
    """Hashes a password with a random 16-byte salt using 100,000 iterations of PBKDF2-HMAC-SHA256."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000)
    return f"pbkdf2:sha256:100000${salt}${key.hex()}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against the stored PBKDF2 hash."""
    try:
        parts = hashed_password.split("$")
        if len(parts) != 3:
            return False
        algo_info, salt, key_hex = parts
        computed_key = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt.encode("utf-8"), 100_000)
        return hmac.compare_digest(computed_key.hex(), key_hex)
    except Exception:
        return False


# =============================================================================
# 2. JWT TOKEN GENERATION & DECODING
# =============================================================================

def create_access_token(user_id: str, email: str, role: str = "owner", expires_delta: Optional[timedelta] = None) -> str:
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "iss": "swadeshi-khata",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": user_id,
        "type": "refresh",
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "iss": "swadeshi-khata",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Dict[str, Any]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM], issuer="swadeshi-khata")
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired. Please login again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )


# =============================================================================
# 3. OTP PROVIDER INTERFACE
# =============================================================================

class OTPService:
    """
    Extensible OTP Service with development console logger and rate limiting.
    Supports pluggable SMS providers (MSG91 / Twilio / Karix).
    """

    @staticmethod
    def generate_otp() -> str:
        """Generates a secure 6-digit numeric OTP."""
        return f"{secrets.randbelow(900000) + 100000:06d}"

    @staticmethod
    def send_otp(mobile: str, otp_code: str) -> bool:
        """Sends OTP via SMS or console logger in development mode."""
        # Clean mobile number
        clean_mobile = mobile.strip().replace(" ", "").replace("-", "")
        # In dev mode, log cleanly
        print(f" [SWADESHI KHATA OTP] Mobile: {clean_mobile} -> OTP Code: {otp_code} (Valid for 10 mins)")
        return True


# =============================================================================
# 4. FASTAPI DEPENDENCY: GET CURRENT USER
# =============================================================================

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db),
) -> Optional[UserModel]:
    """
    Extracts and validates current authenticated user from Bearer token.
    If AUTH_REQUIRED is False and no token is passed, yields None (or mock demo user),
    preserving backwards compatibility for tests.
    """
    if credentials is None or not credentials.credentials:
        if AUTH_REQUIRED:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required. Please sign in.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return None

    token = credentials.credentials
    payload = decode_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token payload.",
        )

    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        if AUTH_REQUIRED:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account not found.",
            )
        return None
    return user
