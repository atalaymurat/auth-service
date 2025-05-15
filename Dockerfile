# Node tabanlı bir imaj kullan
FROM node:18

# Çalışma dizini oluştur
WORKDIR /app

# package.json ve package-lock.json dosyalarını kopyala
COPY package*.json ./

# Bağımlılıkları yükle
RUN npm install

# Proje dosyalarını kopyala
COPY . .

# Uygulamanın hangi portta çalışacağını belirt (örneğin 3001)
EXPOSE 4000

# Başlatma komutu
CMD ["npm", "start"]