import contextvars
from typing import List
from application.ports.services import IIdentityProvider

# Context variables allow state to be passed down the async call stack 
# without passing it explicitly through every function signature.
_current_user_ctx = contextvars.ContextVar("current_user", default="SYSTEM")
_current_roles_ctx = contextvars.ContextVar("current_roles", default=["ANALYST"])


class JWTIdentityProvider(IIdentityProvider):
    """
    Extracts identity from the current execution context.
    """
    async def current_user(self) -> str:
        return _current_user_ctx.get()

    async def current_roles(self) -> List[str]:
        return _current_roles_ctx.get()

    @staticmethod
    def set_identity(username: str, roles: List[str]):
        """Called by the API middleware upon successful JWT validation."""
        _current_user_ctx.set(username)
        _current_roles_ctx.set(roles)