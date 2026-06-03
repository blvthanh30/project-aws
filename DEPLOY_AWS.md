# Deploy AWS

## Phu hop cho kien truc hien tai

Project nay dang chay theo mo hinh:

- `server.js`: Express server
- `public/`: frontend static
- `routes/api.js`: backend API
- `data/*.json`: luu du lieu local

Ban co the deploy nhanh len AWS theo kieu:

- `1 EC2` hoac `1 Lightsail`
- `nginx` reverse proxy
- `node server.js`

Khong nen scale nhieu EC2 khi van dung `data/*.json`, vi moi may se co mot bo du lieu rieng.

## Cac thay doi da bo sung

- Ho tro `.env`
- Route `GET /health` de health check
- `trust proxy` cho nginx / ALB
- Script bootstrap tai [deploy/aws-user-data.sh](deploy/aws-user-data.sh)

## Bien can truyen vao user data

Script `deploy/aws-user-data.sh` dang dung placeholder:

```bash
${github_repo_url}
```

Ban thay bang repo GitHub cua ban, vi du:

```bash
https://github.com/blvthanh30/project-aws
```

## Cach dung nhanh tren EC2

1. Tao EC2 Amazon Linux 2023
2. Mo Security Group:
   - `80` neu dung nginx truc tiep
   - `3000` neu ALB target vao nginx port 3000
   - `22` de SSH
3. Paste noi dung file `deploy/aws-user-data.sh` vao User Data
4. Sua `github_repo_url` trong script
5. Launch instance

## Neu dung ALB

Target Group:

- Protocol: `HTTP`
- Port: `3000`
- Health check path: `/health`

nginx se listen port `3000`, sau do proxy vao Node noi bo port `5001`.

## Lenh kiem tra sau deploy

```bash
sudo systemctl status voidx-shop
sudo journalctl -u voidx-shop -f
sudo systemctl status nginx
curl http://127.0.0.1:5001/health
curl http://127.0.0.1:3000/health
```

## Luu y quan trong

Hien tai du lieu dang nam trong:

- `data/products.json`
- `data/orders.json`
- `data/users.json`
- `data/coupons.json`

Neu ban kinh doanh that, nen chuyen cac file nay sang database nhu Supabase hoac AWS RDS.

## Bien moi truong mac dinh

Co the tao file `.env` nhu sau:

```env
PORT=5001
HOST=0.0.0.0
NODE_ENV=production
```
