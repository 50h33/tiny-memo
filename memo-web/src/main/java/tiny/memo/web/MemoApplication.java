package tiny.memo.web;

import java.nio.file.Path;
import tiny.memo.core.MemoStore;

public final class MemoApplication {
    private MemoApplication() {
    }

    public static void main(String[] args) throws Exception {
        if (args.length > 2) {
            throw new IllegalArgumentException("Usage: MemoApplication [port] [memo-file]");
        }
        int port = args.length > 0 ? Integer.parseInt(args[0]) : 8080;
        Path file = Path.of(args.length > 1 ? args[1] : "data/memo.txt");
        MemoServer server = new MemoServer(new MemoStore(file), port);
        Runtime.getRuntime().addShutdownHook(new Thread(server::close));
        server.start();
        System.out.println("tiny-memo: http://127.0.0.1:" + server.port());
        System.out.println("Memo file: " + file.toAbsolutePath().normalize());
    }
}
