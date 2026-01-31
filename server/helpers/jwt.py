import jwt
import os
# Secret key used to encode and decode the JWT tokens (should be kept safe)
JWT_SECRET = os.environ.get("JWT_SECRET")
JWT_ALGORITHM = "HS256"

def encode_jwt(payload, secret=JWT_SECRET, algorithm=JWT_ALGORITHM):
    """
    Encode a JWT token.

    :param payload: dict containing payload data
    :param secret: key to encode JWT token
    :param algorithm: the JWT signing algorithm
    :return: encoded JWT string
    """
    token = jwt.encode(payload, secret, algorithm=algorithm)
    # For pyjwt >=2.0 jwt.encode returns a string, else bytes
    if isinstance(token, bytes):
        token = token.decode('utf-8')
    return token

def decode_jwt(token, secret=JWT_SECRET, algorithms=[JWT_ALGORITHM]):
    """
    Decode a JWT token.

    :param token: JWT string
    :param secret: key to decode JWT token
    :param algorithms: list of acceptable algorithms
    :return: payload dict if successful, None if failed
    """
    try:
        payload = jwt.decode(token, secret, algorithms=algorithms)
        return payload
    except jwt.ExpiredSignatureError:
        # Signature expired
        print('fucl')
        return None
    except jwt.InvalidTokenError:
        # Invalid token
        print('fucl')
        return None
