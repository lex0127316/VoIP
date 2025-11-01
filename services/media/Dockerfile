FROM rust:1 as builder
WORKDIR /app
COPY ../../Cargo.toml /app/Cargo.toml
COPY ../../shared /app/shared
COPY . /app/services/media
RUN cargo build --release -p media

FROM gcr.io/distroless/cc
WORKDIR /app
COPY --from=builder /app/target/release/media /app/media
USER 65532:65532
ENTRYPOINT ["/app/media"]


