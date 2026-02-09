# ==============================================================================
# Stage 1: Build the Rust binary
# ==============================================================================
FROM rust:1.85-slim AS builder

WORKDIR /build

# No build dependencies needed - using rustls for TLS

# Copy dependency manifests and vendor directory
COPY Cargo.toml ./
COPY .cargo ./.cargo
COPY vendor ./vendor

# Copy source code
COPY src ./src

# Build binary in offline mode
RUN cargo build --release --offline --bin sonar-backend

# ==============================================================================
# Stage 2: Runtime image with Java and SonarScanner
# ==============================================================================
FROM eclipse-temurin:17-jre

WORKDIR /app

# Install required runtime dependencies
RUN apt-get update && apt-get install -y \
    wget \
    unzip \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install SonarScanner CLI
ENV SONAR_SCANNER_VERSION=5.0.1.3006
RUN wget -q https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-${SONAR_SCANNER_VERSION}-linux.zip && \
    unzip sonar-scanner-cli-${SONAR_SCANNER_VERSION}-linux.zip && \
    mv sonar-scanner-${SONAR_SCANNER_VERSION}-linux /opt/sonar-scanner && \
    rm sonar-scanner-cli-${SONAR_SCANNER_VERSION}-linux.zip

# Add sonar-scanner to PATH
ENV PATH="/opt/sonar-scanner/bin:${PATH}"

# Copy the compiled binary from builder
COPY --from=builder /build/target/release/sonar-backend /app/sonar-backend

# Set environment variables
ENV SONARQUBE_URL=http://sonarqube:9000
ENV SONARQUBE_TOKEN=admin
ENV RUST_LOG=info

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8000/ || exit 1

# Run the binary
CMD ["/app/sonar-backend"]
