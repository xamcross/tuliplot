# ---- build stage ----
FROM eclipse-temurin:25-jdk AS build
WORKDIR /app
COPY . .
RUN chmod +x ./gradlew && ./gradlew --no-daemon clean bootJar

# ---- runtime stage ----
FROM eclipse-temurin:25-jre AS runtime
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar
ENV JAVA_OPTS="-Xmx300m"
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
