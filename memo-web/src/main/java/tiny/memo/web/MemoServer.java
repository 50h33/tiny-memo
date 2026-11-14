package tiny.memo.web;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import tiny.memo.core.MemoStore;

public final class MemoServer implements AutoCloseable {
    private final HttpServer server;
    private final MemoStore store;
    private final byte[] page;

    public MemoServer(MemoStore store, int port) throws IOException {
        this.store = store;
        try (InputStream resource = MemoServer.class.getResourceAsStream("/index.html")) {
            if (resource == null) {
                throw new IOException("Missing index.html");
            }
            page = resource.readAllBytes();
        }
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 0);
        server.createContext("/", this::handle);
    }

    public void start() {
        server.start();
    }

    public int port() {
        return server.getAddress().getPort();
    }

    @Override
    public void close() {
        server.stop(0);
    }

    private void handle(HttpExchange exchange) throws IOException {
        try (exchange) {
            exchange.getResponseHeaders().set("Cache-Control", "no-store");
            exchange.getResponseHeaders().set("X-Content-Type-Options", "nosniff");
            String host = exchange.getRequestHeaders().getFirst("Host");
            if (!isLocalHost(host)) {
                sendText(exchange, 403, "Forbidden host");
                return;
            }
            String path = exchange.getRequestURI().getPath();
            String method = exchange.getRequestMethod();
            if (path.equals("/")) {
                if (method.equals("GET")) {
                    send(exchange, 200, "text/html; charset=utf-8", page);
                } else {
                    methodNotAllowed(exchange, "GET");
                }
            } else if (path.equals("/api/memo")) {
                handleMemo(exchange, method);
            } else {
                sendText(exchange, 404, "Not found");
            }
        }
    }

    private boolean isLocalHost(String host) {
        return ("127.0.0.1:" + port()).equalsIgnoreCase(host)
                || ("localhost:" + port()).equalsIgnoreCase(host)
                || (port() == 80 && ("127.0.0.1".equalsIgnoreCase(host) || "localhost".equalsIgnoreCase(host)));
    }

    private void handleMemo(HttpExchange exchange, String method) throws IOException {
        if (method.equals("GET")) {
            String content;
            try {
                content = store.read();
            } catch (IOException exception) {
                sendText(exchange, 500, "메모를 불러오지 못했습니다.");
                return;
            }
            sendText(exchange, 200, content);
        } else if (method.equals("PUT")) {
            try {
                String content = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
                store.save(content);
            } catch (IOException exception) {
                sendText(exchange, 500, "메모를 저장하지 못했습니다.");
                return;
            }
            exchange.sendResponseHeaders(204, -1);
        } else {
            methodNotAllowed(exchange, "GET, PUT");
        }
    }

    private static void methodNotAllowed(HttpExchange exchange, String allowed) throws IOException {
        exchange.getResponseHeaders().set("Allow", allowed);
        sendText(exchange, 405, "Method not allowed");
    }

    private static void sendText(HttpExchange exchange, int status, String content) throws IOException {
        send(exchange, status, "text/plain; charset=utf-8", content.getBytes(StandardCharsets.UTF_8));
    }

    private static void send(HttpExchange exchange, int status, String contentType, byte[] content)
            throws IOException {
        exchange.getResponseHeaders().set("Content-Type", contentType);
        exchange.sendResponseHeaders(status, content.length);
        exchange.getResponseBody().write(content);
    }
}
