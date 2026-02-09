import os
from pr_agent.log import get_logger

class PaymentManager:
    """
    Manages payment verification and bypass logic.
    """
    
    def __init__(self):
        self.is_production = os.environ.get("PRODUCTION", "false").lower() == "true"
        self.bypass_code = "UPCRAFT#123"
        get_logger().info(f"PaymentManager initialized. Production Mode: {self.is_production}")

    def check_access(self, user_id: str, promo_code: str = None) -> bool:
        """
        Determines if a user has access to the service.
        
        Logic:
        1. If PRODUCTION is false (Dev/Test mode) -> Access Granted (free models).
        2. If promo_code == "UPCRAFT#123" -> Access Granted (Bypass).
        3. Otherwise -> Check actual payment (Razorpay - Future Implementation).
        """
        
        # 1. Dev Mode Check
        if not self.is_production:
            get_logger().info(f"Access granted to {user_id} (Development Mode)")
            return True
            
        # 2. Promo Code Bypass
        if promo_code and promo_code.strip() == self.bypass_code:
            get_logger().info(f"Access granted to {user_id} via Promo Code Bypass")
            return True
            
        # 3. Future Razorpay Logic (Stub)
        return self._verify_razorpay_payment(user_id)

    def _verify_razorpay_payment(self, user_id: str) -> bool:
        # TODO: Implement Razorpay API check here later
        # For now, return False in production if no promo code
        get_logger().warning(f"Payment check failed for {user_id} (No active subscription found)")
        return False

    def get_model_config(self):
        """
        Returns the appropriate model configuration based on mode.
        """
        if not self.is_production:
            return {
                "model": "groq/llama-3.3-70b-versatile",
                "fallback_models": ["groq/llama-3.1-8b-instant"]
            }
        else:
            return {
                "model": "openrouter/anthropic/claude-3.5-sonnet",
                "fallback_models": ["openrouter/openai/gpt-4o"]
            }
