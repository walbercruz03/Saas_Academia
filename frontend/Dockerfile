FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL=/api
ARG VITE_WCFIT_SITE_URL
ARG VITE_WCFIT_CONTACT_EMAIL
ENV VITE_API_URL=$VITE_API_URL \
    VITE_WCFIT_SITE_URL=$VITE_WCFIT_SITE_URL \
    VITE_WCFIT_CONTACT_EMAIL=$VITE_WCFIT_CONTACT_EMAIL

RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
