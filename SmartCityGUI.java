import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Component;
import java.awt.GridLayout;
import java.util.Date;
import java.util.List;
import javax.swing.*;

public class SmartCityGUI {

    private static JLabel clockLabel;
    private static JPanel[] laneLights;

    public static volatile int currentGreenLane = -1;
    private static Thread simulationThread;

    public static void main(String[] args) {

        JFrame frame = new JFrame("🚦 Smart City Traffic System");
        frame.setSize(900, 600);
        frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        frame.setLayout(new BorderLayout());

        JPanel topPanel = new JPanel();
        topPanel.setBackground(Color.DARK_GRAY);

        JLabel label = new JLabel("Vehicles: ");
        label.setForeground(Color.WHITE);

        JTextField inputField = new JTextField(15);

        JLabel emergencyLabel = new JLabel("Emergency Lane (0-3): ");
        emergencyLabel.setForeground(Color.WHITE);

        JTextField emergencyField = new JTextField(5);

        JButton runButton = new JButton("Run");
        JButton emergencyButton = new JButton("🚑 Emergency");

        clockLabel = new JLabel();
        clockLabel.setForeground(Color.WHITE);
        updateClock();

        topPanel.add(label);
        topPanel.add(inputField);
        topPanel.add(emergencyLabel);
        topPanel.add(emergencyField);
        topPanel.add(runButton);
        topPanel.add(emergencyButton);
        topPanel.add(clockLabel);

        JPanel lightPanel = new JPanel(new GridLayout(1, 4, 10, 10));
        laneLights = new JPanel[4];

        for (int i = 0; i < 4; i++) {
            laneLights[i] = new JPanel(new GridLayout(3, 1));

            for (int j = 0; j < 3; j++) {
                JPanel bulb = new JPanel();
                bulb.setBackground(Color.DARK_GRAY);
                laneLights[i].add(bulb);
            }

            lightPanel.add(laneLights[i]);
        }

        JPanel centerPanel = new JPanel(new BorderLayout());
        centerPanel.add(lightPanel, BorderLayout.NORTH);
        centerPanel.add(new VehiclePanel(), BorderLayout.CENTER);

        JTextArea outputArea = new JTextArea();
        outputArea.setBackground(Color.BLACK);
        outputArea.setForeground(Color.GREEN);

        JScrollPane scroll = new JScrollPane(outputArea);

        frame.add(topPanel, BorderLayout.NORTH);
        frame.add(centerPanel, BorderLayout.CENTER);
        frame.add(scroll, BorderLayout.SOUTH);
        frame.add(new ComplexityGraphPanel(), BorderLayout.EAST);

        TrafficSmart algo = new TrafficSmart();

        runButton.addActionListener(e -> {
            int[] vehicles = parseInput(inputField.getText());

            outputArea.setText(
                    algo.runSystem(vehicles, false)
                    + TrafficAnalytics.analyze(vehicles)
            );

            List<Integer> order = algo.getSignalOrder(vehicles);
            VehiclePanel.setEmergencyLane(-1);

            startSimulation(order, vehicles);
        });

        emergencyButton.addActionListener(e -> {
            int[] vehicles = parseInput(inputField.getText());

            int emergencyLane = Integer.parseInt(emergencyField.getText().trim());

            outputArea.setText(
                    algo.runSystem(vehicles, true)
                    + TrafficAnalytics.analyze(vehicles)
            );

            List<Integer> order = algo.getSignalOrder(vehicles);

            if (emergencyLane >= 0 && emergencyLane < vehicles.length) {
                order.add(0, emergencyLane);
                VehiclePanel.setEmergencyLane(emergencyLane);
            }

            startSimulation(order, vehicles);
        });

        frame.setVisible(true);
    }

    private static void updateClock() {
        new javax.swing.Timer(1000, e -> {
            clockLabel.setText(new Date().toString());
        }).start();
    }

    private static void startSimulation(List<Integer> order, int[] vehicles) {

        if (simulationThread != null && simulationThread.isAlive()) {
            simulationThread.interrupt();
        }

        simulationThread = new Thread(() -> {
            try {
                for (int laneIndex : order) {

                    if (Thread.currentThread().isInterrupted()) return;

                    SwingUtilities.invokeLater(() -> {
                        for (JPanel p : laneLights) {
                            for (Component c : p.getComponents()) {
                                c.setBackground(Color.DARK_GRAY);
                            }
                        }
                    });

                    currentGreenLane = laneIndex;

                    SwingUtilities.invokeLater(() -> {
                        ((JPanel) laneLights[laneIndex].getComponent(2)).setBackground(Color.GREEN);
                    });

                    int greenTime = Math.min(5000, 500 + vehicles[laneIndex] * 200);
                    Thread.sleep(greenTime);
                }

                currentGreenLane = -1;

            } catch (InterruptedException e) {}
        });

        simulationThread.start();
    }

    private static int[] parseInput(String input) {
        String[] parts = input.split(",");
        int[] arr = new int[parts.length];

        for (int i = 0; i < parts.length; i++) {
            arr[i] = Integer.parseInt(parts[i].trim());
        }

        return arr;
    }
}