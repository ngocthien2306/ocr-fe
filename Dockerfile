FROM node:14-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install --force

COPY . .
RUN npm run build


FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY localhost.crt ./
COPY localhost.key ./
RUN npm install -g @angular/cli
RUN npm install -g http-server
RUN npm install -g serve
EXPOSE 4200
# CMD ["npm", "run", "serve-https"]
CMD ["serve", "-s", "dist", "-l", "4200", "--ssl-cert", "localhost.crt", "--ssl-key", "localhost.key"]