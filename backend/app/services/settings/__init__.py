"""settings service — global admin-editable app settings (spec 47)."""
from app.services.settings.store import get_app_settings, update_app_settings

__all__ = ["get_app_settings", "update_app_settings"]
