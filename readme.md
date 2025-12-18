# 🎟️ TicketBari — Server Side (Backend)

This repository contains the **backend (server side)** of the **TicketBari Online Ticket Booking Platform**.  
The server is built using **Node.js, Express, MongoDB**, and **Stripe**, providing secure APIs for authentication, ticket management, bookings, and payments.

---

## 🌐 Server Overview

| Item | Description |
|----|-------------|
| Project Type | REST API Server |
| Tech Stack | Node.js, Express, MongoDB |
| Authentication | Firebase Admin / JWT |
| Payment | Stripe |
| Environment Security | dotenv |

---

## 🎯 Server Responsibilities

| Module | Description |
|------|-------------|
| Authentication | Verify Firebase / JWT tokens |
| Ticket Management | Add, update, approve & reject tickets |
| Booking System | Handle booking requests & status |
| Role Control | User, Vendor, Admin authorization |
| Payment Processing | Stripe payment intent handling |
| Admin Controls | User roles, fraud detection |
| Advertisement | Control advertised tickets |

---

## 🔐 Security Features

| Feature | Implemented |
|-------|-------------|
| Firebase Token Verification | ✅ |
| Protected API Routes | ✅ |
| Role-based Authorization | ✅ |
| Environment Variable Protection | ✅ |
| CORS Configuration | ✅ |

---

## 📦 NPM Packages Used

### Backend Dependencies

| Category | Packages |
|--------|----------|
| Server Framework | express |
| Database | mongodb |
| Authentication | firebase-admin |
| Payment | stripe |
| Environment Config | dotenv |
| CORS Handling | cors |
| Development Tool | nodemon |

---

## 🗂️ API Modules

| Module | Description |
|------|-------------|
| Auth API | Verify user & role |
| Tickets API | CRUD operations on tickets |
| Bookings API | Book, accept, reject tickets |
| Payments API | Stripe payment processing |
| Users API | Role management |
| Admin API | Approval, fraud control |
| Vendor API | Vendor-specific actions |

---

⚠️ **MongoDB & Firebase credentials are secured using environment variables as required.**

---

## ⚙️ Installation & Setup

| Step | Command |
|----|--------|
| Clone Repository | `git clone https://github.com/shohan12727/TicketBari-server` |
| Install Packages | `npm install` |

---

## 🚀 Deployment Checklist

| Requirement | Status |
|------------|--------|
| Production-ready Server | ✅ |
| No CORS Errors | ✅ |
| No 404 / 504 Errors | ✅ |
| Secure Environment Variables | ✅ |
| Stripe Working in Production | ✅ |

---

## 🧪 API Protection

| Item | Status |
|----|-------|
| Token Required for Private Routes | ✅ |
| Admin/Vendor Route Guard | ✅ |
| User Role Validation | ✅ |

---

## © Copyright

© 2025 **TicketBari**. All rights reserved.
