
"use strict";

const token = sessionStorage.getItem("web_pos_token");
const storedUser = sessionStorage.getItem("web_pos_user");

const userEmail = document.querySelector("#user-email");
const userRole = document.querySelector("#user-role");
const apiStatus = document.querySelector("#api-status");
const dashboardError = document.querySelector("#dashboard-error");
const logoutButton = document.querySelector("#logout-button");

function signOut() {
  sessionStorage.removeItem("web_pos_token");
  sessionStorage.removeItem("web_pos_user");
  window.location.replace("/login.html");
}

logoutButton.addEventListener("click", signOut);

function showError(message) {
  dashboardError.textContent = message;
  dashboardError.hidden = false;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(
      result?.message || `Request failed (${response.status}).`,
    );
    error.status = response.status;
    throw error;
  }

  return result;
}

async function initializeDashboard() {
  if (!token || !storedUser) {
    signOut();
    return;
  }

  let user;

  try {
    user = JSON.parse(storedUser);
  } catch {
    signOut();
    return;
  }

  if (!user || typeof user !== "object") {
    signOut();
    return;
  }

  userEmail.textContent = user.email || "Authenticated user";
  userRole.textContent = user.role || "Verifying access";

  try {
    const [health, protectedResult] = await Promise.all([
      fetch("/health", { credentials: "same-origin" }).then(
        async (response) => {
          if (!response.ok) {
            throw new Error("The API health check failed.");
          }
          return response.json();
        },
      ),
      requestJson("/protected"),
    ]);

    if (health.status !== "ok" || !protectedResult.user) {
      throw new Error("The server returned an unexpected response.");
    }

    userEmail.textContent =
      protectedResult.user.email || user.email || "Authenticated user";
    userRole.textContent =
      protectedResult.user.role || user.role || "Authenticated";

    apiStatus.textContent = "API online · Authenticated";
    apiStatus.classList.add("status-online");
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      signOut();
      return;
    }

    apiStatus.textContent = "API verification failed";
    apiStatus.classList.add("status-error");

    showError(
      error instanceof Error
        ? error.message
        : "Unable to verify the application status.",
    );
  }
}

initializeDashboard();
