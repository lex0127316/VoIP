Auth (dev)
----------

Create `.env.local` with:

```
JWT_SECRET=dev_secret_change_me
```

Routes:
- POST `/api/auth/login` { email, password }
- GET `/api/auth/session`
- POST `/api/auth/logout`


