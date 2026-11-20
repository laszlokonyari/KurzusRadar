# Ubuntu VPS Deployment Guide

This guide deploys the full KurzusRadar stack (Angular + Caddy 2, Node.js Express API, and PostgreSQL 16) on a single Ubuntu 22.04 / 24.04 VPS with automatic Let's Encrypt HTTPS.

## 1. Domain DNS Configuration

At your domain registrar, create an `A` record pointing to your VPS public IPv4 address:

| Type | Name | Value | TTL |
| :--- | :--- | :--- | :--- |
| `A` | `@` (or subdomain, e.g. `kurzusradar`) | `<VPS_PUBLIC_IP>` | Auto / 300 |

Verify propagation before launching Caddy so Let's Encrypt can issue the TLS certificate immediately:

```bash
dig +short your-domain.com
```

## 2. Firewall Setup (UFW)

Expose only SSH, HTTP, and HTTPS. PostgreSQL stays strictly inside the private Docker network.

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

## 3. Install Docker Engine & Compose Plugin

```bash
sudo apt update
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL [https://download.docker.com/linux/ubuntu/gpg](https://download.docker.com/linux/ubuntu/gpg) -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] [https://download.docker.com/linux/ubuntu](https://download.docker.com/linux/ubuntu) \
  $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Log out and reconnect via SSH so group membership takes effect, then verify with `docker compose version`.

## 4. Clone Repository & Configure Production Environment

```bash
git clone [https://github.com/](https://github.com/)<your-username>/<your-repo>.git kurzusradar
cd kurzusradar
cp .env.example .env
```

Generate cryptographically strong secrets for PostgreSQL and JWT signing:

```bash
openssl rand -hex 24
openssl rand -hex 32
```

Edit `.env` (`nano .env`) and replace every placeholder with your real domain and generated secrets:

```env
APP_DOMAIN=your-domain.com
CORS_ORIGIN=[https://your-domain.com](https://your-domain.com)
COOKIE_SECURE=true

POSTGRES_USER=kurzusradar
POSTGRES_PASSWORD=<generated_db_password>
POSTGRES_DB=kurzusradar
JWT_SECRET=<generated_64_char_jwt_secret>
```

Restrict permissions on the secrets file:

```bash
chmod 600 .env
```

## 5. Build & Launch the Production Stack

```bash
docker compose up -d --build
docker compose ps
```

Check Caddy logs to confirm automatic HTTPS certificate provisioning:

```bash
docker compose logs -f web
```

Verify the live deployment:

- Healthcheck: `https://your-domain.com/api/health`
- Application: `https://your-domain.com`

## 6. Deploying Future Updates

```bash
cd ~/kurzusradar
git pull origin main
docker compose up -d --build
```

## 7. Automated Daily PostgreSQL Backups

Create a backup directory and schedule a daily compressed dump at 03:00 via `crontab -e`:

```bash
mkdir -p ~/backups
```

Add the following line to `crontab -e`:

```cron
0 3 * * * cd /home/$USER/kurzusradar && docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \vert{} gzip > /home/$USER/backups/kurzusradar_$(date +\%F).sql.gz && find /home/$USER/backups -type f -name "*.sql.gz" -mtime +14 -delete
```
