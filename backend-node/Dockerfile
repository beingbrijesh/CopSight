# Use Node.js 18 LTS
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

RUN npm install --production

# Bundle app source
COPY . .

# Expose the API port
EXPOSE 8080

# Default command (can be overridden in docker-compose)
CMD [ "node", "src/server.js" ]
