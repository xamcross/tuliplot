plugins {
    java
    id("org.springframework.boot") version "4.1.0"
    id("io.spring.dependency-management") version "1.1.7"
}

group = "com.dashdash"
version = "0.1.0"

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(25))
    }
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("org.springframework.boot:spring-boot-starter-data-mongodb")
    // Spring Session *core* only — managed by the Spring Boot 4.1 BOM (no version). Boot 4.1 ships no
    // MongoDB-backed Spring Session store; storage is the custom MongoSessionRepository added below.
    implementation("org.springframework.session:spring-session-core")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.boot:spring-boot-testcontainers")
    // Carried from Task 2: the relocated @WebMvcTest slice
    // (org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest) lives in this module on Boot 4.1.
    testImplementation("org.springframework.boot:spring-boot-webmvc-test")
    // Testcontainers 2.x (managed by the Boot 4.1 BOM) renamed these modules with a
    // testcontainers- prefix; the old org.testcontainers:junit-jupiter / :mongodb coords do not resolve.
    testImplementation("org.testcontainers:testcontainers-junit-jupiter")
    testImplementation("org.testcontainers:testcontainers-mongodb")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.withType<Test> {
    useJUnitPlatform()
}
