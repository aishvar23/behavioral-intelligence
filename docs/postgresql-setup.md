# Task 2: PostgreSQL Setup (Azure Database for PostgreSQL)

**Status:** Pending
**Prerequisite:** App Service running (Task 1 ✅)

---

## Why

The current deployment uses SQLite stored at `/home/site/wwwroot/data/behavioral.db`.
SQLite is **not durable** on Azure App Service — the `/home/site/wwwroot` filesystem is ephemeral and may be wiped on container restarts or slot swaps. PostgreSQL on Azure provides a persistent, managed database.

---

## Step 1 — Provision PostgreSQL Flexible Server

```bash
az postgres flexible-server create \
  --name bi-postgres-dev \
  --resource-group behavioral-intelligenceRG \
  --location centralus \
  --admin-user biadmin \
  --admin-password <STRONG_PASSWORD> \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --storage-size 32 \
  --version 16 \
  --yes
```

> Cheapest tier: `Standard_B1ms` (~$12/month). Use `--tier Burstable` for dev.

---

## Step 2 — Allow App Service to connect (firewall)

```bash
# Allow Azure services to connect
az postgres flexible-server firewall-rule create \
  --name bi-postgres-dev \
  --resource-group behavioral-intelligenceRG \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

---

## Step 3 — Create the database

```bash
az postgres flexible-server db create \
  --server-name bi-postgres-dev \
  --resource-group behavioral-intelligenceRG \
  --database-name behavioral_intelligence
```

---

## Step 4 — Get connection string

```bash
az postgres flexible-server show-connection-string \
  --server-name bi-postgres-dev \
  --admin-user biadmin \
  --admin-password <STRONG_PASSWORD> \
  --database-name behavioral_intelligence \
  --query connectionStrings.node \
  -o tsv
```

Connection string format:
```
postgresql://biadmin:<password>@bi-postgres-dev.postgres.database.azure.com/behavioral_intelligence?sslmode=require
```

---

## Step 5 — Store in Key Vault (recommended) or App Settings

Option A — App Settings directly (simpler for now):
```bash
az webapp config appsettings set \
  --name bi-backend-dev \
  --resource-group behavioral-intelligenceRG \
  --settings DATABASE_URL="postgresql://biadmin:<password>@bi-postgres-dev.postgres.database.azure.com/behavioral_intelligence?sslmode=require"
```

Option B — Key Vault reference (more secure, do this before production):
```bash
# Add to Key Vault
az keyvault secret set \
  --vault-name bi-keyvault \
  --name DATABASE-URL \
  --value "postgresql://..."

# Reference from App Settings (requires managed identity on App Service)
az webapp config appsettings set \
  --name bi-backend-dev \
  --resource-group behavioral-intelligenceRG \
  --settings DATABASE_URL="@Microsoft.KeyVault(VaultName=bi-keyvault;SecretName=DATABASE-URL)"
```

---

## Step 6 — Run the migration script

```bash
cd backend
DATABASE_URL="postgresql://..." npx ts-node src/db/migrate.ts
```

> The migration script (`backend/src/db/migrate.ts`) needs to be created — see PLAN.md §2.

---

## Step 7 — Update backend code to use PostgreSQL in production

The backend currently uses SQLite unconditionally. Update `backend/src/db/database.ts` to:
- Use **SQLite** when `NODE_ENV !== 'production'`
- Use **PostgreSQL** (`pg` driver) when `NODE_ENV === 'production'` and `DATABASE_URL` is set

Install the `pg` driver:
```bash
cd backend && npm install pg
```

---

## Step 8 — Redeploy

After updating the code, push to `main` — the GitHub Actions workflow will auto-deploy.

---

## Estimated Cost

| Resource | Tier | Monthly Cost |
|----------|------|-------------|
| PostgreSQL Flexible Server | Standard_B1ms Burstable | ~$12 |
| Storage | 32 GB | ~$3 |
| **Total** | | **~$15/month** |
