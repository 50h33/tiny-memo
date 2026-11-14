package tiny.memo.web;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.Socket;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tiny.memo.core.MemoStore;

class MemoServerTest {
    @TempDir
    Path directory;
    private MemoServer server;
    private HttpClient client;
    private Path file;

    @BeforeEach
    void start() throws IOException {
        file = directory.resolve("data/memo.txt");
        client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
        server = new MemoServer(new MemoStore(file), 0);
        server.start();
    }

    @AfterEach
    void stop() {
        server.close();
        client.close();
    }

    @Test
    void servesThePageAndAnInitiallyEmptyMemo() throws Exception {
        HttpResponse<String> page = request("GET", "/", "");
        assertEquals(200, page.statusCode());
        assertTrue(page.headers().firstValue("Content-Type").orElseThrow().contains("text/html"));
        assertTrue(page.body().contains("<textarea"));
        assertTrue(page.body().contains(">저장</button>"));

        HttpResponse<String> memo = request("GET", "/api/memo", "");
        assertEquals(200, memo.statusCode());
        assertEquals("", memo.body());
        assertEquals("no-store", memo.headers().firstValue("Cache-Control").orElseThrow());
    }

    @Test
    void savesUtf8AndReloadsAfterServerRestartThenOverwrites() throws Exception {
        String content = "한글 메모 📝\n두 번째 줄\n";
        assertEquals(204, request("PUT", "/api/memo", content).statusCode());
        assertEquals(content, Files.readString(file, StandardCharsets.UTF_8));
        assertEquals(content, request("GET", "/api/memo", "").body());

        server.close();
        server = new MemoServer(new MemoStore(file), 0);
        server.start();
        assertEquals(content, request("GET", "/api/memo", "").body());

        assertEquals(204, request("PUT", "/api/memo", "새 메모").statusCode());
        assertEquals("새 메모", request("GET", "/api/memo", "").body());
        assertEquals(204, request("PUT", "/api/memo", "").statusCode());
        assertEquals("", request("GET", "/api/memo", "").body());
        assertEquals(0, Files.size(file));
    }

    @Test
    void rejectsUnsupportedMethodsAndUnknownPaths() throws Exception {
        assertEquals(404, request("GET", "/api/memo/extra", "").statusCode());
        HttpResponse<String> response = request("DELETE", "/api/memo", "");
        assertEquals(405, response.statusCode());
        assertEquals("GET, PUT", response.headers().firstValue("Allow").orElseThrow());
        assertEquals(405, request("PUT", "/", "").statusCode());
    }

    @Test
    void reportsReadAndSaveFailuresInsteadOfSuccess() throws Exception {
        Files.createDirectories(file);

        assertEquals(500, request("GET", "/api/memo", "").statusCode());
        assertEquals(500, request("PUT", "/api/memo", "cannot save").statusCode());
        assertTrue(Files.isDirectory(file));
    }

    @Test
    void rejectsForeignHostsWithoutReadingOrOverwritingTheMemo() throws Exception {
        new MemoStore(file).save("private memo");
        for (String method : new String[] {"GET", "PUT"}) {
            try (Socket socket = new Socket("127.0.0.1", server.port())) {
                socket.setSoTimeout(5000);
                String request = method + " /api/memo HTTP/1.1\r\n"
                        + "Host: attacker.invalid:" + server.port() + "\r\n"
                        + "Content-Length: 0\r\nConnection: close\r\n\r\n";
                socket.getOutputStream().write(request.getBytes(StandardCharsets.US_ASCII));
                BufferedReader response = new BufferedReader(new InputStreamReader(
                        socket.getInputStream(), StandardCharsets.UTF_8));
                assertEquals("HTTP/1.1 403 Forbidden", response.readLine());
            }
        }
        assertEquals("private memo", Files.readString(file, StandardCharsets.UTF_8));
    }

    private HttpResponse<String> request(String method, String path, String body) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + server.port() + path))
                .timeout(Duration.ofSeconds(5))
                .header("Content-Type", "text/plain; charset=utf-8")
                .method(method, HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                .build();
        return client.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }
}
