FROM rust:1 as builder
WORKDIR /app
COPY ../../Cargo.toml /app/Cargo.toml
COPY ../../shared /app/shared
COPY . /app/services/signaling
RUN cargo build --release -p signaling

FROM gcr.io/distroless/cc
WORKDIR /app
COPY --from=builder /app/target/release/signaling /app/signaling
EXPOSE 8080
USER 65532:65532
ENTRYPOINT ["/app/signaling"]


