# NGINX Ingress Controller Bootstrap

Project Athena deploy workflow bootstraps `ingress-nginx` directly from the official upstream manifest for cloud environments:

- `https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.3/deploy/static/provider/cloud/deploy.yaml`

This keeps ingress-controller lifecycle explicit and decoupled from application manifests.

## Notes

- The controller service is type `LoadBalancer`; Azure provisions a public IP.
- Control-plane ingress host is configured in:
  - `infrastructure/kubernetes/control-plane/ingress.yaml`
- DNS for `api.athena.teamorchestrator.com` should point to the ingress external endpoint.
- TLS termination is managed by cert-manager + Let's Encrypt:
  - `infrastructure/kubernetes/control-plane/clusterissuer-letsencrypt-prod.yaml`
  - `infrastructure/kubernetes/control-plane/certificate.yaml`
- First certificate issuance depends on DNS propagation for `api.athena.teamorchestrator.com`.
