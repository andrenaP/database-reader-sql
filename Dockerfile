FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . ./
# This forces React to hardcode '.' into the HTML during the build,
# completely overriding any cache or package.json quirks.
ENV PUBLIC_URL=.
RUN npm run build
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
