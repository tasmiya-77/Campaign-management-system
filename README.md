# Campaign Management System

A modern, full-stack Campaign Management System built from scratch with **Vanilla JavaScript, HTML5, CSS3, Node.js, Express, and MySQL (via XAMPP)**.

Designed with a clean, responsive SaaS dashboard interface, secure token authentication using HTTP-only cookies, strict ownership isolation, parameterized SQL queries, and zero unnecessary dependencies or complex frameworks.

---

## Fixed Technology Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (No React, Vue, Tailwind, or Bootstrap)
- **Backend:** Node.js, Express.js
- **Database:** MySQL / MariaDB (via XAMPP) using connection pooling (`mysql2`)
- **Authentication & Security:** JSON Web Tokens (JWT) stored in HTTP-only cookies, password hashing via `bcryptjs`, and in-memory rate limiting
- **Version Control:** Git & GitHub

---

## Project Structure

```text
campaign-management/
├── config/
│   └── db.js                   # MySQL connection pool configuration & connection tester
├── controllers/
│   ├── authController.js       # Register, login, logout, and getMe handlers
│   └── campaignController.js   # Campaign CRUD, search, filter, and stats handlers
├── database/
│   └── schema.sql              # MySQL schema (users & campaigns tables with foreign keys)
├── middleware/
│   ├── authMiddleware.js       # JWT & session verification middleware
│   └── rateLimiter.js          # In-memory sliding-window rate limiter for brute-force defense
├── public/
│   ├── css/
│   │   └── style.css           # Pure CSS3 SaaS light theme (responsive, modals, toasts)
│   ├── js/
│   │   ├── auth.js             # Client auth logic (login, register, validations)
│   │   └── dashboard.js        # Client dashboard logic (CRUD, modals, live stats, search)
│   ├── dashboard.html          # Main SaaS dashboard application
│   ├── index.html              # Login page
│   └── register.html           # User registration page
├── routes/
│   ├── authRoutes.js           # Authentication routes (/api/auth)
│   └── campaignRoutes.js       # Campaign routes (/api/campaigns)
├── scripts/
│   ├── final-audit.js          # Complete 16-point automated audit test runner
│   ├── test-db.js              # Standalone DB connectivity tester
│   ├── verify-auth.js          # Phase 2 authentication test suite
│   ├── verify-campaigns.js     # Phase 3 campaigns CRUD & ownership isolation suite
│   └── verify-frontend.js      # Phase 4 frontend user journey test suite
├── .env.example                # Example environment variables template
├── .gitignore                  # Git ignore rules (node_modules, .env, logs)
├── package.json                # Project dependencies and npm scripts
├── server.js                   # Express server bootstrap, static hosting & error handling
└── README.md                   # Complete system documentation
```

---

## Database Architecture

The system uses a relational database named `campaign_management` with two tables:

### 1. `users` Table
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `INT` | `AUTO_INCREMENT PRIMARY KEY` | Unique User ID |
| `name` | `VARCHAR(100)` | `NOT NULL` | Full name of user |
| `email` | `VARCHAR(150)` | `NOT NULL UNIQUE` | Unique email for authentication |
| `password` | `VARCHAR(255)` | `NOT NULL` | Bcrypt hashed password (salt round 10) |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Account creation timestamp |

### 2. `campaigns` Table
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `INT` | `AUTO_INCREMENT PRIMARY KEY` | Unique Campaign ID |
| `user_id` | `INT` | `NOT NULL, FK -> users(id)` | Campaign owner ID |
| `campaign_name` | `VARCHAR(150)` | `NOT NULL` | Name of marketing campaign |
| `status` | `VARCHAR(50)` | `DEFAULT 'Active'` | Status: `'Active'`, `'Paused'`, `'Completed'` |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Campaign creation timestamp |

**Referential Integrity:** `CONSTRAINT fk_campaigns_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` ensures that if a user account is deleted, their associated campaigns are cleanly purged.

---

## Environment Variables

Create a `.env` file in the project root based on `.env.example`:

```env
# Server Port
PORT=3000

# Database Configuration (XAMPP MySQL defaults)
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=campaign_management

# Authentication Secret
JWT_SECRET=super_secret_campaign_management_jwt_key_2026
```

---

## Local Installation & Setup

### 1. Prerequisites
- **Node.js** (v18+ recommended, tested on Node v22.18.0)
- **XAMPP** (Apache + MySQL)

### 2. Clone and Install Dependencies
```bash
git clone https://github.com/<your-username>/campaign-management.git
cd campaign-management
npm install
```

### 3. XAMPP Database Initialization
1. Open the **XAMPP Control Panel** and click **Start** next to **MySQL**.
2. Open your terminal or phpMyAdmin (`http://localhost/phpmyadmin`).
3. Import the database schema:
   ```bash
   mysql -u root -p < database/schema.sql
   ```
   *(If your local root account has no password, omit the `-p` flag).*

### 4. Verify Database Connectivity
```bash
npm run test:db
```

### 5. Run the Server
- **Development mode (with auto-reload):**
  ```bash
  npm run dev
  ```
- **Production mode:**
  ```bash
  npm start
  ```

Access the application in your browser at: `http://localhost:3000`

---

## API Endpoints Reference

### Authentication Endpoints (`/api/auth`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Registers a new user with `name`, `email`, and `password`. Returns `201 Created` and sets HTTP-only cookie. |
| `POST` | `/api/auth/login` | Public (Rate-limited) | Validates credentials, issues JWT in HTTP-only cookie, returns `200 OK`. |
| `POST` | `/api/auth/logout` | Authenticated | Clears the `token` HTTP-only cookie. |
| `GET` | `/api/auth/me` | Authenticated | Returns current authenticated user record (`id`, `name`, `email`, `created_at`). |

### Campaign Endpoints (`/api/campaigns`)

*All campaign routes require authentication via HTTP-only cookie or Bearer token.*

| Method | Endpoint | Query Params | Description |
|---|---|---|---|
| `GET` | `/api/campaigns` | `?search=term&status=Active` | Lists all campaigns belonging to the authenticated user with optional search and status filtering. |
| `GET` | `/api/campaigns/stats` | None | Returns aggregated counts: `{ total, active, paused, completed }` for the authenticated user. |
| `GET` | `/api/campaigns/:id` | None | Retrieves a specific campaign by ID. Returns `404` if not found or unauthorized. |
| `POST` | `/api/campaigns` | None | Creates a new campaign with `campaign_name` and optional `status`. Returns `201 Created`. |
| `PUT` | `/api/campaigns/:id` | None | Updates `campaign_name` and/or `status` of an existing campaign. |
| `DELETE` | `/api/campaigns/:id` | None | Deletes a campaign belonging to the authenticated user. |

### System & Health Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Returns server uptime, status, and active MySQL connection status (`200 OK` or `503 Service Unavailable`). |

---

## Automated Test Suites

The project includes four automated integration test suites executed with standard Node.js:

```bash
# Run the complete test suite (Phases 2, 3, 4)
npm test

# Run the 16-point final comprehensive audit
npm run audit

# Run specific domain test suites
npm run test:auth          # Authentication, validation, and rate limiting
npm run test:campaigns     # Campaign CRUD, search, filter, and ownership isolation
npm run test:frontend      # Static asset delivery and full user journey
npm run test:db            # MySQL connection test
```

---

## Security Audit & Safeguards

- **Password Hashing:** Passwords are never stored in plaintext. They are encrypted using `bcryptjs` with salt round `10` before insertion.
- **Strict Parameterized Queries:** All SQL statements in `authController.js` and `campaignController.js` use `pool.execute(query, [params])` with placeholders (`?`), neutralizing SQL injection attacks.
- **Cookie Security:** JWT tokens are transmitted via cookies with `httpOnly: true` (inaccessible to JavaScript, defending against XSS) and `sameSite: 'strict'` (defending against CSRF).
- **Strict User Ownership Isolation:** All campaign operations (`SELECT`, `UPDATE`, `DELETE`) enforce `WHERE id = ? AND user_id = ?`. Users cannot read, modify, or delete another user's campaigns.
- **Login Rate Limiter:** Protects `/api/auth/login` from brute-force password cracking by restricting requests from the same IP to 5 attempts per 15 minutes.
- **Credential Protection:** Secrets and credentials reside strictly in `.env`. `.gitignore` prevents exposure to version control. Passwords and hashes are omitted from all API responses.

---

## Deployment Instructions

### Production Checklist
1. **Environment Variables:**
   - Set `NODE_ENV=production`.
   - Set a strong, randomly generated `JWT_SECRET`.
   - Configure production database credentials (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL=true`).
2. **Reverse Proxy (Render / Nginx / Cloudflare):**
   - In production, `trust proxy` is enabled to support HTTPS cookie transmission and accurate client IP rate limiting.
   - Ensure SSL/TLS is enabled; cookies with `secure: true` will be automatically enforced in production.

---

## Free Cloud Deployment Guide: Render + TiDB Cloud

This system is fully configured for 100% free cloud deployment using:
- **TiDB Cloud Serverless:** Free MySQL 8.0-compatible distributed cloud database (5 GiB free storage, automated backups, TLS 1.2+ encryption).
- **Render Web Service:** Free cloud hosting for Node.js apps with automatic HTTPS, continuous deployment from Git, and health monitoring.

---

### Step 1: Create Free TiDB Cloud Database
1. Go to [TiDB Cloud](https://tidbcloud.com) and create a free account (no credit card required).
2. In the TiDB Cloud Console, click **Create Cluster** and choose **Serverless (Free)**.
3. Select your preferred region (e.g., `AWS / us-east-1` or `AWS / eu-central-1`).
4. Click **Create**. Your cluster will be provisioned in ~30 seconds.
5. In the cluster dashboard, click **Connect**:
   - Choose connection method: **General** or **Standard Connection**.
   - Note down:
     - **Host:** e.g. `gateway01.us-east-1.prod.aws.tidbcloud.com`
     - **Port:** `4000`
     - **User:** e.g. `xxxxxx.root`
     - **Password:** (Set or generate your cluster password)
     - **Database:** `campaign_management` (or `test`)

---

### Step 2: Initialize Database Schema in TiDB Cloud
Choose either of the two methods below:

#### Method A: Via TiDB Cloud Web SQL Editor (Simplest)
1. In the TiDB Cloud console, navigate to **SQL Editor** on the left menu.
2. Ensure your target database is selected (or run `CREATE DATABASE IF NOT EXISTS campaign_management; USE campaign_management;`).
3. Copy the contents of `database/schema-production.sql` and click **Run**.
4. Confirm that `users` and `campaigns` tables are created.

#### Method B: Via CLI Migration Script
Run the automated initialization script from your machine with TiDB connection details:
```bash
DB_HOST="gateway01.us-east-1.prod.aws.tidbcloud.com" \
DB_PORT=4000 \
DB_USER="xxxxxx.root" \
DB_PASSWORD="your_password" \
DB_NAME="campaign_management" \
DB_SSL=true \
npm run db:init
```

---

### Step 3: Deploy to Render

#### Option A: Using Render Blueprint (`render.yaml`)
1. Push your repository to GitHub.
2. In the [Render Dashboard](https://dashboard.render.com), click **New** -> **Blueprint**.
3. Connect your repository. Render detects `render.yaml` automatically.
4. Render will prompt you for:
   - `DB_HOST`: Your TiDB Cloud Host
   - `DB_USER`: Your TiDB Cloud User
   - `DB_PASSWORD`: Your TiDB Cloud Password
   - `DB_NAME`: Your TiDB database name (`campaign_management`)
5. Click **Apply**. Render will automatically generate a secure `JWT_SECRET` and deploy the service.

#### Option B: Manual Web Service Setup
1. In Render Dashboard, click **New** -> **Web Service**.
2. Connect your GitHub repository.
3. Configure the service settings:
   - **Name:** `campaign-management`
   - **Region:** Same region as TiDB Cloud for lowest latency
   - **Branch:** `main`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`
4. Expand **Advanced** -> **Health Check Path** and set it to: `/api/health`.
5. Under **Environment Variables**, add the following:

| Key | Recommended Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Enables secure cookies and production error handling |
| `DB_HOST` | *Your TiDB Host* | e.g. `gateway01.us-east-1.prod.aws.tidbcloud.com` |
| `DB_PORT` | `4000` | Default TiDB Serverless port |
| `DB_USER` | *Your TiDB User* | e.g. `xxxxxx.root` |
| `DB_PASSWORD` | *Your TiDB Password* | TiDB cluster password |
| `DB_NAME` | `campaign_management` | Database name |
| `DB_SSL` | `true` | Enforces TLS 1.2+ encryption for TiDB Cloud |
| `JWT_SECRET` | *Random 64+ char string* | Secret key for JWT signing |
| `TRUST_PROXY` | `true` | Enables correct client IP tracking behind Render proxy |

6. Click **Create Web Service**.

---

### Step 4: Verify Deployment
Once the deployment displays **Live**:
1. Open `https://your-service-name.onrender.com/api/health` in your browser.
   - Expected status: `HTTP 200`
   - Response:
     ```json
     {
       "status": "ok",
       "services": {
         "server": "running",
         "database": "connected"
       },
       "databaseDetails": {
         "active": true
       }
     }
     ```
2. Navigate to `https://your-service-name.onrender.com` to access the login page and test registration and campaign management.


