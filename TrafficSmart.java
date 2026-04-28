import java.util.*;

public class TrafficSmart {

    public String runSystem(int[] v, boolean emergency) {

        StringBuilder sb = new StringBuilder();

        sb.append("Traffic Input:\n");

        for (int i = 0; i < v.length; i++)
            sb.append("Lane ").append(i).append(": ").append(v[i]).append("\n");

        if (emergency) sb.append("\n🚑 Emergency Mode\n");

        List<Integer> order = getSignalOrder(v);

        sb.append("\nOrder:\n");

        for (int lane : order)
            sb.append("Lane ").append(lane).append(" GREEN\n");

        return sb.toString();
    }

    public List<Integer> getSignalOrder(int[] v) {

        List<Integer> order = new ArrayList<>();

        PriorityQueue<int[]> pq =
                new PriorityQueue<>((a, b) -> b[0] - a[0]);

        for (int i = 0; i < v.length; i++)
            pq.add(new int[]{v[i], i});

        while (!pq.isEmpty()) {

            int[] cur = pq.poll();

            int count = cur[0];
            int lane = cur[1];

            int pass = Math.min(10, count);
            count -= pass;

            order.add(lane);

            if (count > 0)
                pq.add(new int[]{count, lane});
        }

        return order;
    }
}