public class TrafficAnalytics {

    public static String analyze(int[] vehicles) {

        int n = vehicles.length;

        int greedyOps = n * (int)(Math.log(n) / Math.log(2));
        int pqOps = greedyOps;
        int dpOps = n * n;

        StringBuilder sb = new StringBuilder();

        sb.append("\n===== COMPLEXITY ANALYSIS =====\n");
        sb.append("Input Size (n): ").append(n).append("\n\n");

        sb.append("Greedy Approach:\n");
        sb.append("Time Complexity: O(n log n)\n");
        sb.append("Estimated Operations: ").append(greedyOps).append("\n\n");

        sb.append("Priority Queue:\n");
        sb.append("Time Complexity: O(n log n)\n");
        sb.append("Estimated Operations: ").append(pqOps).append("\n\n");

        sb.append("Dynamic Programming:\n");
        sb.append("Time Complexity: O(n^2)\n");
        sb.append("Estimated Operations: ").append(dpOps).append("\n\n");

        sb.append("Conclusion:\n");
        sb.append("Greedy + Priority Queue is more efficient for real-time traffic systems.");

        return sb.toString();
    }
}