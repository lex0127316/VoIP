FROM rust:1 as builder
WORKDIR /app
COPY ../../Cargo.toml /app/Cargo.toml
COPY ../../shared /app/shared
COPY . /app/services/api
RUN cargo build --release -p api

FROM gcr.io/distroless/cc
WORKDIR /app
COPY --from=builder /app/target/release/api /app/api
EXPOSE 8081
USER 65532:65532
ENTRYPOINT ["/app/api"]


