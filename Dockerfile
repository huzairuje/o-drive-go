# Production runtime for ODrive Go
FROM alpine:3.21
WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata wget curl && \
    addgroup -g 1001 -S odrive && \
    adduser -u 1001 -S odrive -G odrive && \
    mkdir -p /app/data && \
    chown -R odrive:odrive /app

COPY --chown=odrive:odrive bin/odrive /app/odrive
RUN chmod +x /app/odrive

USER odrive
EXPOSE 8090

VOLUME ["/app/data"]

ENTRYPOINT ["/app/odrive"]
CMD ["-addr", ":8090"]
