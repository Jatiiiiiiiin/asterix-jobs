import React from "react";
import { useNavigate } from "react-router-dom";

const PaymentButton: React.FC = () => {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    localStorage.setItem("auth_intent", "buy_plan");
    localStorage.setItem("selected_plan", "student"); // Default for this button
    navigate("/confirm-payment");
  };

  return (
    <button
      onClick={handleUpgrade}
      className="px-6 py-3 bg-black text-white hover:bg-gray-800 rounded-lg text-xs font-black tracking-widest transition-all"
    >
      Upgrade to Premium
    </button>
  );
};

export default PaymentButton;

