"use strict";

const TOKEN_KEY = "web_pos_token";
const USER_KEY = "web_pos_user";
const PAGE_SIZE = 20;

const elements = {
  search: document.querySelector("#product-search"),
  catalogStatus: document.querySelector("#catalog-status"),
  productGrid: document.querySelector("#product-grid"),
  previousPage: document.querySelector("#previous-page"),
  nextPage: document.querySelector("#next-page"),
  pageLabel: document.querySelector("#page-label"),
  cartStatus: document.querySelector("#cart-status"),
  cartItems: document.querySelector("#cart-items"),
  clearCart: document.querySelector("#clear-cart"),
  subtotal: document.querySelector("#subtotal"),
  total: document.querySelector("#total"),
  checkoutForm: document.querySelector("#checkout-form"),
  paymentMethod: document.querySelector("#payment-method"),
  paymentReference: document.querySelector("#payment-reference"),
  checkoutButton: document.querySelector("#checkout-button"),
  checkoutError: document.querySelector("#checkout-error"),
  logoutButton: document.querySelector("#logout-button"),
  receiptDialog: document.querySelector("#receipt-dialog"),
  receiptDetails: document.querySelector("#receipt-details"),
  printReceipt: document.querySelector("#print-receipt"),
  newSale: document.querySelector("#new-sale"),
};

const state = {
  products: [],
  cart: new Map(),
  page: 1,
  totalPages: 1,
  search: "",
  loadingProducts: false,
  submittingSale: false,
};

let searchTimeout;

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

function formatMoney(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "KES --";
  }

  return `KES ${amount.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

async function apiRequest(path, options = {}) {
  const token = getToken();

  if (!token) {
    window.location.replace("/login.html");
    throw new Error("Your session has expired. Please sign in again.");
  }

  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  if (response.status === 401 || response.status === 403) {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    window.location.replace("/login.html");
    throw new Error("Your session has expired. Please sign in again.");
  }

  if (response.status === 204) {
    return null;
  }

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(
      result?.message || `Request failed (${response.status}).`,
    );

    error.status = response.status;
    error.code = result?.error;
    throw error;
  }

  return result;
}

async function loadProducts() {
  if (state.loadingProducts) {
    return;
  }

  state.loadingProducts = true;
  elements.catalogStatus.textContent = "Loading products...";
  elements.productGrid.replaceChildren();
  elements.previousPage.disabled = true;
  elements.nextPage.disabled = true;

  const parameters = new URLSearchParams({
    page: String(state.page),
    pageSize: String(PAGE_SIZE),
    sortBy: "name",
    sortOrder: "asc",
    isActive: "true",
  });

  if (state.search) {
    parameters.set("search", state.search);
  }

  try {
    const result = await apiRequest(`/products?${parameters.toString()}`);

    if (
      !result ||
      !Array.isArray(result.products) ||
      !result.pagination
    ) {
      throw new Error("The product API returned an unexpected response.");
    }

    state.products = result.products;
    state.totalPages = Math.max(1, result.pagination.totalPages || 1);

    renderProducts();

    const total = result.pagination.total;
    elements.catalogStatus.textContent =
      total === 0
        ? "No active products found."
        : `${total} active product${total === 1 ? "" : "s"} found.`;
  } catch (error) {
    elements.catalogStatus.textContent = error.message;
  } finally {
    state.loadingProducts = false;
    elements.previousPage.disabled =
      state.page <= 1 || state.loadingProducts;
    elements.nextPage.disabled =
      state.page >= state.totalPages || state.loadingProducts;
  }
}

function renderProducts() {
  elements.productGrid.replaceChildren();

  for (const product of state.products) {
    const card = document.createElement("article");
    card.className = "product-card";

    const name = document.createElement("h3");
    name.textContent = product.name;

    const sku = document.createElement("p");
    sku.className = "muted product-sku";
    sku.textContent = `SKU: ${product.sku}`;

    const price = document.createElement("strong");
    price.className = "product-price";
    price.textContent = formatMoney(product.price);

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.textContent = state.cart.has(product.id)
      ? "Add another"
      : "Add to cart";
    addButton.addEventListener("click", () => addToCart(product));

    card.append(name, sku, price, addButton);
    elements.productGrid.append(card);
  }

  elements.pageLabel.textContent =
    `Page ${state.page} of ${state.totalPages}`;

  elements.previousPage.disabled = state.page <= 1;
  elements.nextPage.disabled =
    state.page >= state.totalPages;

  renderCart();
}

function addToCart(product) {
  const existing = state.cart.get(product.id);

  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.set(product.id, {
      id: product.id,
      name: product.name,
      sku: product.sku,
      price: Number(product.price),
      quantity: 1,
    });
  }

  renderProducts();
}

function changeQuantity(productId, delta) {
  const item = state.cart.get(productId);

  if (!item) {
    return;
  }

  const nextQuantity = item.quantity + delta;

  if (nextQuantity <= 0) {
    state.cart.delete(productId);
  } else {
    item.quantity = nextQuantity;
  }

  renderProducts();
}

function renderCart() {
  elements.cartItems.replaceChildren();

  const items = [...state.cart.values()];

  elements.cartStatus.textContent = items.length
    ? `${items.length} distinct product${items.length === 1 ? "" : "s"} in cart.`
    : "Your cart is empty.";

  let subtotal = 0;

  for (const item of items) {
    subtotal += item.price * item.quantity;

    const row = document.createElement("article");
    row.className = "cart-item";

    const details = document.createElement("div");
    details.className = "cart-item-details";

    const name = document.createElement("strong");
    name.textContent = item.name;

    const lineTotal = document.createElement("span");
    lineTotal.textContent = formatMoney(item.price * item.quantity);

    const sku = document.createElement("span");
    sku.className = "muted";
    sku.textContent = item.sku;

    details.append(name, sku, lineTotal);

    const controls = document.createElement("div");
    controls.className = "quantity-controls";

    const decrease = document.createElement("button");
    decrease.type = "button";
    decrease.className = "quantity-button";
    decrease.textContent = "-";
    decrease.setAttribute(
      "aria-label",
      `Decrease quantity of ${item.name}`,
    );
    decrease.addEventListener("click", () => {
      changeQuantity(item.id, -1);
    });

    const quantity = document.createElement("span");
    quantity.textContent = String(item.quantity);

    const increase = document.createElement("button");
    increase.type = "button";
    increase.className = "quantity-button";
    increase.textContent = "+";
    increase.setAttribute(
      "aria-label",
      `Increase quantity of ${item.name}`,
    );
    increase.addEventListener("click", () => {
      changeQuantity(item.id, 1);
    });

    controls.append(decrease, quantity, increase);
    row.append(details, controls);
    elements.cartItems.append(row);
  }

  elements.subtotal.textContent = formatMoney(subtotal);
  elements.total.textContent = formatMoney(subtotal);

  elements.checkoutButton.disabled =
    items.length === 0 || state.submittingSale;

  elements.clearCart.disabled =
    items.length === 0 || state.submittingSale;
}

function showCheckoutError(message) {
  elements.checkoutError.textContent = message;
  elements.checkoutError.hidden = false;
}

function clearCheckoutError() {
  elements.checkoutError.textContent = "";
  elements.checkoutError.hidden = true;
}

function renderReceipt(sale) {
  if (
    !sale ||
    !sale.receiptNo ||
    !Array.isArray(sale.items) ||
    !Array.isArray(sale.payments)
  ) {
    throw new Error(
      "The sale was submitted, but its receipt response was incomplete. Check the sales records before retrying.",
    );
  }

  const wrapper = document.createElement("div");
  wrapper.className = "receipt-paper";

  const receiptNumber = document.createElement("p");
  receiptNumber.textContent = `Receipt: ${sale.receiptNo}`;

  const date = document.createElement("p");
  date.textContent = `Date: ${new Date(sale.createdAt).toLocaleString()}`;

  wrapper.append(receiptNumber, date);

  const table = document.createElement("table");
  table.className = "receipt-table";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  for (const heading of ["Product ID", "Qty", "Unit price", "Line total"]) {
    const th = document.createElement("th");
    th.textContent = heading;
    headerRow.append(th);
  }

  thead.append(headerRow);

  const tbody = document.createElement("tbody");

  for (const item of sale.items) {
    const row = document.createElement("tr");

    for (const value of [
      item.productId,
      item.quantity,
      formatMoney(item.unitPrice),
      formatMoney(item.lineTotal),
    ]) {
      const cell = document.createElement("td");
      cell.textContent = String(value);
      row.append(cell);
    }

    tbody.append(row);
  }

  table.append(thead, tbody);

  const totals = document.createElement("div");
  totals.className = "receipt-totals";

  for (const [label, value] of [
    ["Subtotal", sale.subtotal],
    ["Discount", sale.discount],
    ["Tax", sale.tax],
    ["Total paid", sale.total],
  ]) {
    const row = document.createElement("p");
    const labelElement = document.createElement("span");
    const valueElement = document.createElement("strong");

    labelElement.textContent = label;
    valueElement.textContent = formatMoney(value);

    row.append(labelElement, valueElement);
    totals.append(row);
  }

  const paymentHeading = document.createElement("h3");
  paymentHeading.textContent = "Payment";

  const payments = document.createElement("ul");

  for (const payment of sale.payments) {
    const entry = document.createElement("li");
    entry.textContent =
      `${payment.method}: ${formatMoney(payment.amount)} (${payment.status})`;
    payments.append(entry);
  }

  wrapper.append(table, totals, paymentHeading, payments);
  elements.receiptDetails.replaceChildren(wrapper);

  elements.receiptDialog.showModal();
}

async function submitSale(event) {
  event.preventDefault();
  clearCheckoutError();

  if (state.submittingSale || state.cart.size === 0) {
    return;
  }

  const items = [...state.cart.values()];

  // Use the displayed estimate only to form the request. The backend
  // recalculates prices and validates the exact payment amount.
  const estimatedTotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  state.submittingSale = true;
  elements.checkoutButton.disabled = true;
  elements.checkoutButton.textContent = "Processing...";
  elements.clearCart.disabled = true;

  try {
    const result = await apiRequest("/sales", {
      method: "POST",
      body: JSON.stringify({
        discount: 0,
        tax: 0,
        items: items.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
          discount: 0,
        })),
        payment: {
          method: elements.paymentMethod.value,
          amount: Number(estimatedTotal.toFixed(2)),
          ...(elements.paymentReference.value.trim()
            ? { reference: elements.paymentReference.value.trim() }
            : {}),
        },
      }),
    });

    if (!result?.sale) {
      throw new Error(
        "The server response did not contain a sale. Verify the sale record before trying again.",
      );
    }

    // Do not retry automatically if receipt rendering fails: the sale may
    // already have committed on the server.
    state.cart.clear();
    renderProducts();
    elements.paymentReference.value = "";

    try {
      renderReceipt(result.sale);
    } catch (receiptError) {
      showCheckoutError(receiptError.message);
    }

    await loadProducts();
  } catch (error) {
    let message = error.message;

    if (error.status === 409) {
      message =
        "The sale could not be completed because stock or payment details conflict with the current records. Review the cart and try again.";
    } else if (error.status === 400) {
      message =
        "The server rejected the sale details. Refresh the product list and verify the cart total before retrying.";
    }

    showCheckoutError(message);
  } finally {
    state.submittingSale = false;
    elements.checkoutButton.textContent = "Complete sale";
    renderCart();
  }
}

async function logout() {
  elements.logoutButton.disabled = true;

  try {
    await apiRequest("/auth/logout", { method: "POST" });
  } catch {
    // Clear the local session even if the logout request fails.
  } finally {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    window.location.replace("/login.html");
  }
}

elements.search.addEventListener("input", () => {
  window.clearTimeout(searchTimeout);

  searchTimeout = window.setTimeout(() => {
    state.search = elements.search.value.trim();
    state.page = 1;
    loadProducts();
  }, 250);
});

elements.previousPage.addEventListener("click", () => {
  if (state.page > 1 && !state.loadingProducts) {
    state.page -= 1;
    loadProducts();
  }
});

elements.nextPage.addEventListener("click", () => {
  if (state.page < state.totalPages && !state.loadingProducts) {
    state.page += 1;
    loadProducts();
  }
});

elements.clearCart.addEventListener("click", () => {
  state.cart.clear();
  renderProducts();
  clearCheckoutError();
});

elements.checkoutForm.addEventListener("submit", submitSale);

elements.logoutButton.addEventListener("click", logout);

elements.printReceipt.addEventListener("click", () => {
  window.print();
});

elements.newSale.addEventListener("click", () => {
  elements.receiptDialog.close();
  clearCheckoutError();
  elements.search.focus();
});

if (!getToken()) {
  window.location.replace("/login.html");
} else {
  loadProducts();
}