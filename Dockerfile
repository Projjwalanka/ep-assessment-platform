# syntax=docker/dockerfile:1
# Single image: React UI built with Node, bundled into the Spring Boot jar, run on a JDK
# (a full JDK, not a JRE, because hands-on answers are compiled in-process with javac).

FROM node:20-alpine AS ui
WORKDIR /ui
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM maven:3.9-eclipse-temurin-21 AS api
WORKDIR /api
COPY backend/pom.xml .
RUN mvn -B -q dependency:go-offline || true
COPY backend/src ./src
COPY --from=ui /ui/dist ./src/main/resources/static
RUN mvn -B -q -DskipTests package

FROM eclipse-temurin:21-jdk-alpine
RUN apk add --no-cache su-exec \
 && addgroup -S app && adduser -S app -G app \
 && mkdir -p /app/data && chown -R app:app /app
WORKDIR /app
COPY --from=api /api/target/exam-portal.jar /app/app.jar
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh
ENV DATA_DIR=/app/data \
    JAVA_OPTS="-XX:MaxRAMPercentage=45 -XX:+UseSerialGC -Xss512k -XX:TieredStopAtLevel=1"
EXPOSE 8080
ENTRYPOINT ["/app/docker-entrypoint.sh"]
