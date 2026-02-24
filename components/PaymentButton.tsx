import React from "react";

declare global {
  interface Window {
    Razorpay: any;
  }
}

const PaymentButton = () => {
  const startPayment = async () => {
    const res = await fetch("http://localhost:8000/payments/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 499 }),
    });

    const order = await res.json();

    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: "INR",
      name: "Asterix Find",
      description: "Premium Access",
      order_id: order.id,

      handler: async (response: any) => {
        await fetch("http://localhost:8000/payments/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(response),
        });

        alert("Payment successful 🚀");
      },
    };

    new window.Razorpay(options).open();
  };

  return (
    <button
      onClick={startPayment}
      style={{
        padding: "12px 20px",
        background: "#000",
        color: "#fff",
        borderRadius: "8px",
        border: "none",
        cursor: "pointer",
      }}
    >
      Upgrade to Premium
    </button>
  );
};

export default PaymentButton;
