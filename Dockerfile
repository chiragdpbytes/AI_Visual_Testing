# Use the official Microsoft Playwright image as the base. 
# This includes Node.js and all required OS-level browser dependencies.
FROM mcr.microsoft.com/playwright:v1.45.1-jammy

# Set working directory
WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install npm dependencies
RUN npm ci

# Copy the rest of the application files
COPY . .

# Build the frontend and compile the server
RUN npm run build

# Expose port 3000
EXPOSE 3000

# Set production environment variable
ENV NODE_ENV=production

# Start the compiled Express server
CMD ["npm", "start"]
