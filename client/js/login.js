
"use strict";

const form = document.querySelector("#login-form");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const submitButton = document.querySelector("#login-button");
const errorMessage = document.querySelector("#login-error");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  errorMessage.hidden = true;
  errorMessage.textContent = "";

  submitButton.disabled = true;
  submitButton.textContent = "Signing in…";

  try {
    const response = await fetch("/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify({
        email: emailInput.value.trim(),
        password: passwordInput.value,
      }),
    });

    const result = response.status === 204
      ? null
      : await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        response.status === 401
          ? "Invalid email or password."
          : result?.message || "Sign-in failed. Please try again."
      );
    }

    if (!result?.token || !result?.user) {
      throw new Error("The server returned an incomplete login response.");
    }

    sessionStorage.setItem("web_pos_token", result.token);
    sessionStorage.setItem("web_pos_user", JSON.stringify(result.user));

    window.location.assign("/pos.html");
  } catch (error) {
    errorMessage.textContent =
      error instanceof Error
        ? error.message
        : "Unable to connect. Please try again.";

    errorMessage.hidden = false;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Sign in";
  }
});
