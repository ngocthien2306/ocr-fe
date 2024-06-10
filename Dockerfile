FROM node:alpine

WORKDIR /usr/src/app

COPY . /usr/src/app

RUN npm install -g @angular/cli

RUN npm install --force

EXPOSE 4200

CMD ["npm", "run", "start"]



# # Use an official Node.js runtime as a base image
# FROM node:14-alpine AS build

# # Set the working directory in the container
# WORKDIR /app

# # Copy package.json and package-lock.json to the working directory
# COPY package*.json ./

# # Install project dependencies
# RUN npm install

# # Copy the remaining application code to the working directory
# COPY . .

# # Build the React app
# RUN npm run build

# FROM node:20-alpine
# WORKDIR /app
# COPY --from=build /app/build ./build

# RUN npm install -g serve

# # Expose the port that the app will run on
# EXPOSE 3000

# CMD ["serve", "-s", "build"]
