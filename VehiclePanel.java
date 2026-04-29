import java.awt.*;
import javax.swing.*;

class VehiclePanel extends JPanel {

    private int[][] x = new int[4][5];
    private static int emergencyLane = -1;
    private boolean flash = false;

    public static void setEmergencyLane(int lane) {
        emergencyLane = lane;
    }

    public VehiclePanel() {

        setBackground(Color.BLACK);

        for (int i = 0; i < 4; i++)
            for (int j = 0; j < 5; j++)
                x[i][j] = -j * 100;

        new Timer(40, e -> {

            flash = !flash;

            for (int i = 0; i < 4; i++) {

                if (SmartCityGUI.currentGreenLane == i) {
                    for (int j = 0; j < 5; j++)
                        x[i][j] += 6;
                }

                for (int j = 0; j < 5; j++)
                    if (x[i][j] > getWidth())
                        x[i][j] = -100;
            }

            repaint();
        }).start();
    }

    protected void paintComponent(Graphics g) {
        super.paintComponent(g);

        Graphics2D g2 = (Graphics2D) g;

        g2.setColor(new Color(60, 60, 60));
        g2.fillRect(0, 0, getWidth(), getHeight());

        g2.setColor(Color.YELLOW);
        for (int i = 1; i < 4; i++)
            g2.drawLine(0, i * 60, getWidth(), i * 60);

        for (int lane = 0; lane < 4; lane++) {
            for (int v = 0; v < 5; v++) {

                int px = x[lane][v];
                int py = 10 + lane * 60;

                if (lane == emergencyLane && v == 0) {

                    g2.setColor(Color.WHITE);
                    g2.fillRoundRect(px, py, 60, 25, 10, 10);

                    g2.setColor(flash ? Color.RED : Color.BLUE);
                    g2.fillRect(px + 15, py - 5, 30, 5);

                    g2.drawString("🚑", px + 20, py + 18);

                } else {

                    g2.setColor(Color.RED);
                    g2.fillRoundRect(px, py, 55, 22, 10, 10);

                    g2.setColor(Color.BLACK);
                    g2.fillOval(px + 5, py + 15, 10, 10);
                    g2.fillOval(px + 35, py + 15, 10, 10);
                }
            }
        }
    }
}