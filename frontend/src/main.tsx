import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import DecisionInput from "./pages/DecisionInput";
import Login from "./pages/Login";

const router = createBrowserRouter([
  { path: "/", element: <DecisionInput /> },
  { path: "/login", element: <Login /> },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
