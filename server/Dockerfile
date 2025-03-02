FROM node:20

WORKDIR /app

COPY package*.json ./

# Clear npm cache and install dependencies (with more verbose output)
RUN npm cache clean --force && \
    npm install

# Copy the rest of the application
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]