function formatPrice(n) {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function sendNotification(topic, data, costcoPrice, bidPrice, netPayout, type = 'profit') {
  try {
    let title, body, priority, tags;

    if (type === 'profit') {
      const lossPercent = data.toFixed(2);
      title = '🪙 Gold Flip Alert!';
      body = `Loss is only ${lossPercent}%!\nCostco: $${formatPrice(costcoPrice)}\nCollectPure Bid: $${formatPrice(bidPrice)}\nNet Payout: $${formatPrice(netPayout)}`;
      priority = 'high';
      tags = 'moneybag';
    } else if (type === 'price_change') {
      const { oldPrice, newPrice, bidPrice: bid, profitLossPercent } = data;
      title = '🪙 Costco Price Changed';
      body = `Old: $${formatPrice(oldPrice)} → New: $${formatPrice(newPrice)}\nCollectPure Bid: $${formatPrice(bid)}\nFlip Loss: ${profitLossPercent.toFixed(2)}%`;
      priority = 'default';
      tags = 'chart_with_upwards_trend';
    } else if (type === 'warning') {
      title = '⚠️ ' + data;
      body = costcoPrice; // costcoPrice is actually the message for warnings
      priority = 'high';
      tags = 'warning';
    } else {
      throw new Error(`Unknown notification type: ${type}`);
    }

    const url = `https://ntfy.sh/${encodeURIComponent(topic)}`;
    console.log('Sending notification to ntfy:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Title': title,
        'Priority': priority,
        'Tags': tags,
        'Click': 'https://gold-flip-monitor.vercel.app'
      },
      body
    });

    if (!response.ok) {
      throw new Error(`ntfy returned status ${response.status}`);
    }

    console.log('Notification sent successfully');
    return { success: true, timestamp: new Date().toISOString() };
  } catch (error) {
    console.error('Error sending notification:', error.message);
    throw error;
  }
}
