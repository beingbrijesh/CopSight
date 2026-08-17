"""Unit and integration tests for CopSight macOS Daemon."""

import unittest
import asyncio
from httpx import AsyncClient, ASGITransport
from apps.macos.daemon.server import app, bridge


class TestMacOSDaemon(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.transport = ASGITransport(app=app)
        self.client = AsyncClient(transport=self.transport, base_url="http://testserver")

    async def asyncTearDown(self):
        await self.client.aclose()

    async def test_daemon_health(self):
        """Verify health endpoint returns healthy status and version."""
        response = await self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")
        self.assertIn("version", data)
        self.assertIn("usb_available", data)

    async def test_daemon_status(self):
        """Verify status endpoint returns running state."""
        response = await self.client.get("/api/status")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("is_running", data)
        self.assertFalse(data["is_running"])

    async def test_daemon_devices(self):
        """Verify device detection endpoint responds with valid schema."""
        response = await self.client.get("/api/devices")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertIn("devices", data)
        self.assertIsInstance(data["devices"], list)

    async def test_daemon_acquire_validation(self):
        """Verify missing case_info returns 400."""
        response = await self.client.post("/api/acquire/start", json={})
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.json()["success"])


if __name__ == "__main__":
    unittest.main()
